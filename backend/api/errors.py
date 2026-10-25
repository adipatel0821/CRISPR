"""Error schema (contracts §4): every error body is `ErrorBody {error: {code, message, details, request_id}}`.

Domain exceptions raised by the pure modules (intake / documents / llm) are mapped by class name so the API does
not need to import those packages at start-up (they are built in parallel and imported lazily).
No stack traces and no user-supplied values ever appear in an error body; the server log carries request ids only.
"""
from __future__ import annotations

import logging
import traceback
from collections.abc import Callable
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException as StarletteHTTPException

from schemas.contracts import ErrorBody, ErrorDetail

log = logging.getLogger("decisiontwin.api")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: Any = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


def not_found(what: str = "Resource") -> ApiError:
    return ApiError(404, "NOT_FOUND", f"{what} not found.")


def unauthorized(message: str = "A valid session token is required (Authorization: Bearer <token>).") -> ApiError:
    return ApiError(401, "UNAUTHORIZED", message)


def validation(message: str, details: Any = None) -> ApiError:
    return ApiError(400, "VALIDATION_ERROR", message, details)


# class name -> (status, code, default message, extra details)
DOMAIN_ERRORS: dict[str, tuple[int, str, str, dict[str, Any] | None]] = {
    "FactValidationError": (400, "VALIDATION_ERROR", "One or more answers are not valid.", None),
    "ConflictingFacts": (409, "CONFLICTING_FACTS", "Two of your answers contradict each other.", None),
    "UnsupportedProduct": (422, "UNSUPPORTED_PRODUCT",
                           "This loan has features DecisionTwin cannot calculate (for example a variable rate "
                           "or a balloon payment).", None),
    "DataModeRestricted": (403, "DATA_MODE_RESTRICTED",
                           "In the current data mode only the bundled sample documents can be uploaded. "
                           "You can type the loan terms instead.", None),
    "ExtractionFailed": (422, "EXTRACTION_FAILED",
                         "We could not read the loan terms from this file. You can type them in instead.", None),
    "UnsupportedUpload": (422, "EXTRACTION_FAILED",
                          "This file type is not supported. Upload a PDF, PNG or JPEG, or type the terms in.", None),
    "LLMUnavailable": (503, "LLM_UNAVAILABLE",
                       "The AI assistant is unavailable right now. Typed entry still works.",
                       {"fallback_available": True}),
    "LLMMalformedOutput": (502, "LLM_MALFORMED_OUTPUT",
                           "The AI assistant returned an unusable answer. Typed entry still works.",
                           {"fallback_available": True}),
}


def map_domain_error(exc: BaseException) -> ApiError | None:
    for cls in type(exc).__mro__:
        spec = DOMAIN_ERRORS.get(cls.__name__)
        if spec is None:
            continue
        status, code, default_msg, extra = spec
        message = str(exc).strip() or default_msg
        details: Any = getattr(exc, "details", None)
        if extra:
            details = {**(details if isinstance(details, dict) else {}), **extra}
        return ApiError(status, code, message, details)
    return None


def request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def error_response(request: Request, status: int, code: str, message: str, details: Any = None) -> JSONResponse:
    rid = request_id(request)
    body = ErrorBody(error=ErrorDetail(code=code, message=message, details=details, request_id=rid))
    headers = {"X-Request-ID": rid} if rid else None
    return JSONResponse(status_code=status, content=body.model_dump(mode="json"), headers=headers)


def _field_message(err: dict[str, Any]) -> dict[str, Any]:
    loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path", "header")]
    field = ".".join(loc) or "request"
    msg = err.get("msg", "invalid value")
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]
    return {"field": field, "message": f"{field}: {msg}", "type": err.get("type")}


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [_field_message(e) for e in exc.errors()]
    message = "; ".join(f["message"] for f in fields[:5]) or "The request is not valid."
    return error_response(request, 400, "VALIDATION_ERROR", message, {"fields": fields})


async def _api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return error_response(request, exc.status, exc.code, exc.message, exc.details)


async def _http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Only contract ErrorCode values (D0-005): 405/413/other 4xx -> VALIDATION_ERROR, 5xx -> INTERNAL.
    code = {401: "UNAUTHORIZED", 403: "DATA_MODE_RESTRICTED", 404: "NOT_FOUND", 429: "RATE_LIMITED",
            501: "NOT_IMPLEMENTED"}.get(exc.status_code,
                                        "INTERNAL" if exc.status_code >= 500 else "VALIDATION_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    if exc.status_code == 404:
        message = "Not found."
    return error_response(request, exc.status_code, code, message)


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:  # pragma: no cover - last resort
    log.error("unhandled error request_id=%s type=%s", request_id(request), type(exc).__name__)
    return error_response(request, 500, "INTERNAL", "Something went wrong on our side. Please retry.")


def install(app) -> None:
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(ApiError, _api_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_handler)
    app.add_exception_handler(Exception, _unhandled_handler)


class ErrorMappingRoute(APIRoute):
    """Route class that converts domain exceptions and unexpected errors into `ApiError` *inside* the route, so the
    response goes through the normal exception middleware (no re-raise, no stack trace in the body)."""

    def get_route_handler(self) -> Callable:
        original = super().get_route_handler()

        async def handler(request: Request):
            try:
                return await original(request)
            except (ApiError, RequestValidationError, StarletteHTTPException):
                raise
            except Exception as exc:  # noqa: BLE001
                mapped = map_domain_error(exc)
                if mapped is not None:
                    log.info("domain error request_id=%s code=%s", request_id(request), mapped.code)
                    raise mapped from None
                # Frames only (no exception message, which may contain user values).
                log.error("internal error request_id=%s type=%s\n%s", request_id(request), type(exc).__name__,
                          "".join(traceback.format_tb(exc.__traceback__)))
                raise ApiError(500, "INTERNAL", "Something went wrong on our side. Please retry.") from None

        return handler
