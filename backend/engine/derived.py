"""``Derived``: an intermediate engine value with its provenance (weakest status/verification, missing inputs)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from .inputs import Input, weakest_status, weakest_verification


@dataclass(frozen=True)
class Derived:
    value: Decimal | None
    missing: tuple[str, ...] = ()
    statuses: tuple[str, ...] = ()
    verifications: tuple[str, ...] = ()
    label: str | None = None
    assumptions: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()

    @property
    def known(self) -> bool:
        return self.value is not None and not self.missing

    @property
    def status(self) -> str:
        return weakest_status(self.statuses)

    @property
    def verification(self) -> str:
        return weakest_verification(self.verifications)


Part = Input | Derived


def combine(value: Decimal | None, parts: Iterable[Part], *, extra_missing: Iterable[str] = (),
            label: str | None = None, assumptions: Iterable[str] = (), notes: Iterable[str] = ()) -> Derived:
    """Merge provenance of the parts; if anything is missing the value is forced to None (never zero)."""
    missing: list[str] = list(extra_missing)
    statuses: list[str] = []
    verifs: list[str] = []
    assm: list[str] = list(assumptions)
    nts: list[str] = list(notes)
    for p in parts:
        if isinstance(p, Derived):
            missing.extend(p.missing)
            statuses.extend(p.statuses)
            verifs.extend(p.verifications)
            assm.extend(p.assumptions)
            nts.extend(p.notes)
        else:
            if not p.known:
                missing.append(p.key)
            else:
                statuses.append(p.status)
                verifs.append(p.verification)
    missing = list(dict.fromkeys(missing))
    return Derived(value=None if missing else value, missing=tuple(missing), statuses=tuple(statuses),
                   verifications=tuple(verifs), label=label, assumptions=tuple(dict.fromkeys(assm)),
                   notes=tuple(dict.fromkeys(nts)))


def missing(*keys: str) -> Derived:
    return Derived(value=None, missing=tuple(dict.fromkeys(keys)))
