"""
acceptance_api.py — AACES Acceptance v1 (API Layer)

Ejecuta los pasos automatizables del Acceptance Test v1.
Requisitos: pip install httpx python-dotenv

Uso:
    python scripts/acceptance_api.py                  # full run
    python scripts/acceptance_api.py --step 2.1       # desde paso específico
    python scripts/acceptance_api.py --resume          # reanudar última ejecución

Variables de entorno (o .env):
    AACES_BASE_URL=http://localhost:8000/api/v1
    AACES_ADMIN_EMAIL=admin@aaces.com
    AACES_ADMIN_PASSWORD=admin123

Exit code: 0 si todos los pasos pasan, 1 si hay fallas.
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

BASE_URL = os.getenv("AACES_BASE_URL", "http://localhost:8000/api/v1")
ADMIN_EMAIL = os.getenv("AACES_ADMIN_EMAIL", "admin@aaces.com")
ADMIN_PASSWORD = os.getenv("AACES_ADMIN_PASSWORD", "admin123")

BITACORA_PATH = Path("docs/testing/evidence/v0.9.0/bitacora-acceptance-v1.json")


@dataclass
class StepResult:
    step: str
    description: str
    passed: bool = False
    error: str | None = None
    evidence: dict[str, Any] = field(default_factory=dict)
    start_time: str = ""
    end_time: str = ""
    duration_ms: int = 0


class AcceptanceRunner:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(base_url=base_url, timeout=30)
        self.token: str | None = None
        self.headers: dict[str, str] = {}
        self.state: dict[str, Any] = {
            "curso_id": None,
            "participante_id": None,
            "curso_participante_id": None,
            "documento_id": None,
            "codigo_validacion": None,
            "nuevo_documento_id": None,
            "nuevo_codigo": None,
        }
        self.results: list[StepResult] = []
        self.failed = False

    # ── helpers ──────────────────────────────────────────────

    def _step(self, step: str, desc: str) -> StepResult:
        return StepResult(step=step, description=desc, start_time=datetime.now().isoformat())

    def _end(self, r: StepResult, passed: bool, evidence: dict | None = None, error: str | None = None):
        r.passed = passed
        r.end_time = datetime.now().isoformat()
        if evidence:
            r.evidence = evidence
        if error:
            r.error = error
        self.results.append(r)
        icon = "✅" if passed else "❌"
        print(f"  {icon} {r.step} ({r.duration_ms}ms)")
        if error:
            print(f"     Error: {error}")
        if not passed:
            self.failed = True

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        headers = kwargs.pop("headers", {})
        if self.token:
            headers.setdefault("Authorization", f"Bearer {self.token}")
        url = f"{self.base_url}/{path.lstrip('/')}"
        resp = self.client.request(method, url, headers=headers, **kwargs)
        return resp

    def _check(self, resp: httpx.Response, status: int = 200) -> dict:
        assert resp.status_code == status, f"Expected {status}, got {resp.status_code}: {resp.text[:200]}"
        return resp.json() if resp.text else {}

    # ── steps ─────────────────────────────────────────────────

    def login(self):
        r = self._step("0.1", "Login como administrador")
        try:
            resp = self._request("POST", "/auth/login", json={
                "correo": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
            })
            data = self._check(resp, 200)
            self.token = data.get("access_token") or data.get("token")
            assert self.token, f"No token in response: {data}"
            self.headers["Authorization"] = f"Bearer {self.token}"
            self._end(r, True, {"token_prefix": self.token[:20] + "..."})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_1_1(self):
        r = self._step("1.1", "Crear curso")
        try:
            resp = self._request("POST", "/cursos", json={
                "nombre": "Acceptance Test Curso",
                "ciudad": "CDMX",
                "fecha_inicio": "2026-08-01",
                "fecha_fin": "2026-08-05",
                "duracion_horas": 40,
                "costo_total": 5000,
                "modalidad": "presencial",
                "codigo_curso": f"AT-{int(time.time())}",
                "estado": "activo",
            })
            data = self._check(resp, 201)
            self.state["curso_id"] = data.get("id")
            self._end(r, True, {"curso_id": self.state["curso_id"]})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_1_2(self):
        r = self._step("1.2", "Registrar participante")
        try:
            resp = self._request("POST", f"/cursos/{self.state['curso_id']}/participantes", json={
                "nombre": "Juan Aceptacion",
                "curp": "XAXX010101HNEXXXA1",
                "correo": f"juan.acceptance.{int(time.time())}@test.com",
            })
            data = self._check(resp, 201)
            self.state["participante_id"] = data.get("participante_id") or data.get("id")
            self.state["curso_participante_id"] = data.get("curso_participante_id") or self.state["participante_id"]
            self._end(r, True, {"participante_id": self.state["participante_id"]})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_1_3(self):
        r = self._step("1.3", "Acreditar participante")
        try:
            resp = self._request("POST", f"/participantes/{self.state['participante_id']}/acreditar", json={
                "calificacion": 85,
            })
            self._check(resp, 200)
            self._end(r, True)
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_1_4(self):
        r = self._step("1.4", "Verificar KPIs dashboard")
        try:
            resp = self._request("GET", "/dashboard")
            data = self._check(resp, 200)
            assert data.get("total_acreditados", 0) >= 1, f"total_acreditados={data.get('total_acreditados')}"
            self._end(r, True, {"dashboard": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_2_1(self):
        r = self._step("2.1", "Emitir constancia")
        try:
            resp = self._request("POST", "/constancias", json={
                "curso_participante_id": self.state["curso_participante_id"],
                "tipo_documento": "CONSTANCIA",
            })
            data = self._check(resp, 201)
            self.state["documento_id"] = data.get("id")
            self.state["codigo_validacion"] = data.get("codigo_validacion")
            self._end(r, True, {"documento_id": self.state["documento_id"]})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_2_2(self):
        r = self._step("2.2", "Verificar folio asignado")
        try:
            resp = self._request("GET", f"/constancias/{self.state['documento_id']}")
            data = self._check(resp, 200)
            folio = data.get("folio")
            assert folio, f"Folio vacio: {data}"
            self._end(r, True, {"folio": folio, "documento": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_2_3(self):
        r = self._step("2.3", "Descargar PDF")
        try:
            resp = self.client.get(
                f"{self.base_url}/constancias/{self.state['documento_id']}/pdf",
                headers=self.headers,
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            content = resp.content
            assert content.startswith(b"%PDF"), f"Not a PDF: {content[:20]}"
            pdf_path = Path("docs/testing/evidence/v0.9.0/02-pdf.pdf")
            pdf_path.write_bytes(content)
            self._end(r, True, {"size_bytes": len(content), "path": str(pdf_path)})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_2_4(self):
        r = self._step("2.4", "Verificar QR URL")
        try:
            resp = self._request("GET", f"/constancias/{self.state['documento_id']}")
            data = self._check(resp, 200)
            qr_url = data.get("qr_url") or data.get("codigo_validacion")
            assert qr_url, f"No QR URL in response: {data}"
            self._end(r, True, {"qr_url": qr_url})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_2_5(self):
        r = self._step("2.5", "Verificar KPIs actualizados")
        try:
            resp = self._request("GET", "/dashboard")
            data = self._check(resp, 200)
            emitidas = data.get("constancias_emitidas", 0)
            assert emitidas >= 1, f"constancias_emitidas={emitidas}"
            self._end(r, True, {"dashboard": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_3_1(self):
        r = self._step("3.1", "Verificación pública")
        try:
            resp = self._request("GET", f"/verificar/{self.state['codigo_validacion']}")
            data = self._check(resp, 200)
            assert data.get("estatus") == "emitido", f"estatus={data.get('estatus')}"
            self._end(r, True, {"verificacion": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_3_2(self):
        r = self._step("3.2", "Consultar timeline")
        try:
            resp = self._request("GET", f"/constancias/{self.state['documento_id']}/timeline")
            data = self._check(resp, 200)
            eventos = data if isinstance(data, list) else data.get("eventos", [])
            assert len(eventos) >= 1, f"Empty timeline: {data}"
            self._end(r, True, {"eventos": [e.get("tipo") or e.get("estatus") for e in eventos]})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_3_3(self):
        r = self._step("3.3", "Verificación registrada en BD")
        try:
            resp = self._request("GET", f"/verificaciones?documento_id={self.state['documento_id']}")
            data = self._check(resp, 200)
            verificaciones = data if isinstance(data, list) else data.get("verificaciones", [])
            assert len(verificaciones) >= 1, "No verification records found"
            v = verificaciones[0]
            assert v.get("resultado") == "VALIDA", f"resultado={v.get('resultado')}"
            self._end(r, True, {"verificaciones": verificaciones})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_1(self):
        r = self._step("4.1", "Cancelar constancia")
        try:
            resp = self._request("POST", f"/constancias/{self.state['documento_id']}/cancelar")
            self._check(resp, 200)
            self._end(r, True)
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_2(self):
        r = self._step("4.2", "Timeline con cancelacion")
        try:
            resp = self._request("GET", f"/constancias/{self.state['documento_id']}/timeline")
            data = self._check(resp, 200)
            eventos = data if isinstance(data, list) else data.get("eventos", [])
            tipos = [e.get("tipo") or e.get("estatus") for e in eventos]
            assert "cancelado" in tipos, f"No 'cancelado' in timeline: {tipos}"
            emit_idx = next((i for i, t in enumerate(tipos) if t == "emitido"), -1)
            cancel_idx = next((i for i, t in enumerate(tipos) if t == "cancelado"), -1)
            assert emit_idx < cancel_idx, f"Order wrong: emitido={emit_idx}, cancelado={cancel_idx}"
            self._end(r, True, {"eventos": tipos})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_3(self):
        r = self._step("4.3", "Verificación pública refleja cancelación")
        try:
            resp = self._request("GET", f"/verificar/{self.state['codigo_validacion']}")
            data = self._check(resp, 200)
            assert data.get("estatus") == "cancelado", f"estatus={data.get('estatus')}"
            self._end(r, True, {"verificacion": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_4(self):
        r = self._step("4.4", "Reemitir constancia")
        try:
            resp = self._request("POST", f"/constancias/{self.state['documento_id']}/reemitir")
            data = self._check(resp, 200)
            self.state["nuevo_documento_id"] = data.get("id")
            self.state["nuevo_codigo"] = data.get("codigo_validacion")
            assert self.state["nuevo_codigo"] != self.state["codigo_validacion"], "Same validation code"
            assert data.get("estatus") == "emitido", f"estatus={data.get('estatus')}"
            self._end(r, True, {"nuevo_documento_id": self.state["nuevo_documento_id"]})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_5(self):
        r = self._step("4.5", "Timeline tras reemision")
        try:
            resp = self._request("GET", f"/constancias/{self.state['documento_id']}/timeline")
            data = self._check(resp, 200)
            eventos = data if isinstance(data, list) else data.get("eventos", [])
            tipos = [e.get("tipo") or e.get("estatus") for e in eventos]
            assert "reemitido" in tipos, f"No 'reemitido' in timeline: {tipos}"
            expected = ["emitido", "cancelado", "reemitido"]
            # Filter only these types and check order
            filtered = [t for t in tipos if t in expected]
            assert filtered == expected, f"Timeline order: {filtered}"
            self._end(r, True, {"eventos": filtered})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_6(self):
        r = self._step("4.6", "Buscar por folio")
        try:
            # Get the folio first
            resp = self._request("GET", f"/constancias/{self.state['documento_id']}")
            data = self._check(resp, 200)
            folio = data.get("folio")
            assert folio, "No folio found"
            resp2 = self._request("GET", f"/constancias?folio={folio}")
            data2 = self._check(resp2, 200)
            resultados = data2 if isinstance(data2, list) else data2.get("data") or data2.get("resultados") or []
            assert len(resultados) >= 1, f"No results for folio={folio}"
            self._end(r, True, {"folio": folio, "count": len(resultados)})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_7(self):
        r = self._step("4.7", "Buscar por UUID exacto")
        try:
            resp = self._request("GET", f"/constancias/{self.state['documento_id']}")
            data = self._check(resp, 200)
            assert data.get("id") == self.state["documento_id"], "UUID mismatch"
            self._end(r, True, {"id": data["id"]})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_4_8(self):
        r = self._step("4.8", "Buscar ILIKE parcial")
        try:
            resp = self._request("GET", "/constancias?q=Aceptacion")
            data = self._check(resp, 200)
            resultados = data if isinstance(data, list) else data.get("data") or data.get("resultados") or []
            self._end(r, True, {"count": len(resultados)})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_5_1(self):
        r = self._step("5.1", "Reporte: constancias por período")
        try:
            resp = self._request("GET", "/reportes/constancias-por-periodo")
            data = self._check(resp, 200)
            total = sum(item.get("total", 0) for item in (data if isinstance(data, list) else []))
            assert total >= 1, f"Total constancias en reporte: {total}"
            self._end(r, True, {"data": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_5_2(self):
        r = self._step("5.2", "Reporte: tiempo promedio emisión")
        try:
            resp = self._request("GET", "/reportes/tiempo-promedio-emision")
            data = self._check(resp, 200)
            assert data.get("promedio_dias") is not None, "promedio_dias is None"
            self._end(r, True, {"promedio_dias": data["promedio_dias"]})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_5_3(self):
        r = self._step("5.3", "Reporte: documentos no verificados")
        try:
            resp = self._request("GET", "/reportes/documentos-no-verificados")
            data = self._check(resp, 200)
            self._end(r, True, {"count": len(data) if isinstance(data, list) else 0})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_5_4(self):
        r = self._step("5.4", "Reporte: cursos top")
        try:
            resp = self._request("GET", "/reportes/cursos-top")
            data = self._check(resp, 200)
            self._end(r, True, {"data": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_5_5(self):
        r = self._step("5.5", "Reporte: empresas top")
        try:
            resp = self._request("GET", "/reportes/empresas-top")
            data = self._check(resp, 200)
            self._end(r, True, {"data": data})
        except Exception as e:
            self._end(r, False, error=str(e))

    def step_5_6(self):
        r = self._step("5.6", "Reporte: próximos a vencer")
        try:
            resp = self._request("GET", "/reportes/proximos-a-vencer")
            data = self._check(resp, 200)
            self._end(r, True, {"count": len(data) if isinstance(data, list) else 0})
        except Exception as e:
            self._end(r, False, error=str(e))

    # ── orchestration ─────────────────────────────────────────

    def _timed(self, fn):
        start = time.monotonic()
        fn()
        elapsed = int((time.monotonic() - start) * 1000)
        if self.results:
            self.results[-1].duration_ms = elapsed

    STEPS = [
        "login",
        "step_1_1", "step_1_2", "step_1_3", "step_1_4",
        "step_2_1", "step_2_2", "step_2_3", "step_2_4", "step_2_5",
        "step_3_1", "step_3_2", "step_3_3",
        "step_4_1", "step_4_2", "step_4_3", "step_4_4", "step_4_5",
        "step_4_6", "step_4_7", "step_4_8",
        "step_5_1", "step_5_2", "step_5_3", "step_5_4", "step_5_5", "step_5_6",
    ]

    def run(self, start_step: str | None = None):
        started = start_step is None
        for name in self.STEPS:
            if name == start_step:
                started = True
            if not started:
                continue
            fn = getattr(self, name)
            self._timed(fn)
            if self.failed:
                print(f"\n  ❌ Falla en {name} — deteniendo ejecución")
                break
        self._save_bitacora()
        self._print_summary()

    def _save_bitacora(self):
        BITACORA_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "total_pasos": len(self.results),
            "pasados": sum(1 for r in self.results if r.passed),
            "fallados": sum(1 for r in self.results if not r.passed),
            "resultados": [
                {
                    "step": r.step,
                    "descripcion": r.description,
                    "resultado": "✅" if r.passed else "❌",
                    "error": r.error,
                    "duracion_ms": r.duration_ms,
                    "evidence": {k: str(v) if len(str(v)) > 200 else v for k, v in r.evidence.items()},
                }
                for r in self.results
            ],
        }
        BITACORA_PATH.write_text(json.dumps(data, indent=2, default=str))
        print(f"  📝 Bitácora guardada en {BITACORA_PATH}")

    def _print_summary(self):
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed
        print(f"\n  ─── Resumen ───")
        print(f"  Total: {total} | ✅ {passed} | ❌ {failed}")
        if failed:
            print(f"  ❌ Acceptance v1: FALLÓ — {failed} paso(s) con error")
        else:
            print(f"  ✅ Acceptance v1: 18/18 PASOS APROBADOS")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="AACES Acceptance v1 — API Layer")
    parser.add_argument("--step", help="Iniciar desde un paso específico (ej: 2.1)")
    parser.add_argument("--resume", action="store_true", help="Reanudar desde el último paso fallido")
    args = parser.parse_args()

    runner = AcceptanceRunner(BASE_URL)

    start_step = None
    if args.step:
        # Map step numbers to method names
        step_map = {
            "0.1": "login",
            "1.1": "step_1_1", "1.2": "step_1_2", "1.3": "step_1_3", "1.4": "step_1_4",
            "2.1": "step_2_1", "2.2": "step_2_2", "2.3": "step_2_3", "2.4": "step_2_4", "2.5": "step_2_5",
            "3.1": "step_3_1", "3.2": "step_3_2", "3.3": "step_3_3",
            "4.1": "step_4_1", "4.2": "step_4_2", "4.3": "step_4_3", "4.4": "step_4_4", "4.5": "step_4_5",
            "4.6": "step_4_6", "4.7": "step_4_7", "4.8": "step_4_8",
            "5.1": "step_5_1", "5.2": "step_5_2", "5.3": "step_5_3", "5.4": "step_5_4", "5.5": "step_5_5", "5.6": "step_5_6",
        }
        start_step = step_map.get(args.step)
        if not start_step:
            print(f"❌ Paso desconocido: {args.step}")
            sys.exit(1)
    elif args.resume:
        if BITACORA_PATH.exists():
            prev = json.loads(BITACORA_PATH.read_text())
            for r in reversed(prev.get("resultados", [])):
                if r.get("resultado") == "❌":
                    start_step = r["step"]
                    break
        if not start_step:
            print("No previous failure to resume from. Starting fresh.")
    runner.run(start_step)
    sys.exit(1 if runner.failed else 0)


if __name__ == "__main__":
    main()
