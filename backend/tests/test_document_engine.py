import pytest
import os
import tempfile
from app.services.document_types import DocumentDefinition, DocumentResult
from app.services.storage_provider import LocalStorageProvider
from app.services.qr_service import qr_service
from app.services.hash_service import hash_service
from app.services.template_engine import template_engine
from app.services.renderer import WeasyPrintRenderer


@pytest.mark.asyncio
async def test_document_definition_defaults():
    dd = DocumentDefinition(html="<p>test</p>")
    assert dd.html == "<p>test</p>"
    assert dd.recursos == {}
    assert dd.config == {}


@pytest.mark.asyncio
async def test_document_result():
    dr = DocumentResult(
        storage_provider="local",
        storage_key="test/test.pdf",
        pdf_hash="abc123",
        html_snapshot="<p>test</p>",
    )
    assert dr.storage_provider == "local"
    assert dr.storage_key == "test/test.pdf"


@pytest.mark.asyncio
async def test_local_storage_provider_save_and_read():
    with tempfile.TemporaryDirectory() as tmp:
        sp = LocalStorageProvider(base_dir=tmp)
        key = await sp.save("test/hello.txt", b"hello world")
        assert key == "test/hello.txt"
        data = await sp.read("test/hello.txt")
        assert data == b"hello world"
        exists = await sp.exists("test/hello.txt")
        assert exists is True
        url = await sp.url("test/hello.txt")
        assert url == "/storage/test/hello.txt"


@pytest.mark.asyncio
async def test_local_storage_provider_delete():
    with tempfile.TemporaryDirectory() as tmp:
        sp = LocalStorageProvider(base_dir=tmp)
        await sp.save("test/del.txt", b"delete me")
        assert await sp.exists("test/del.txt") is True
        deleted = await sp.delete("test/del.txt")
        assert deleted is True
        assert await sp.exists("test/del.txt") is False
        deleted = await sp.delete("test/del.txt")
        assert deleted is False


@pytest.mark.asyncio
async def test_local_storage_provider_get_stream():
    with tempfile.TemporaryDirectory() as tmp:
        sp = LocalStorageProvider(base_dir=tmp)
        content = b"x" * 100000
        await sp.save("test/stream.bin", content)
        chunks = []
        async for chunk in sp.get_stream("test/stream.bin"):
            chunks.append(chunk)
        assert b"".join(chunks) == content


@pytest.mark.asyncio
async def test_qr_service_generates_svg():
    svg = await qr_service.generate("https://example.com/verify/123")
    assert "<svg" in svg
    assert "</svg>" in svg
    assert "path" in svg or "rect" in svg


@pytest.mark.asyncio
async def test_hash_service_sha256():
    h = await hash_service.sha256(b"test content")
    assert isinstance(h, str)
    assert len(h) == 64
    assert all(c in "0123456789abcdef" for c in h)


@pytest.mark.asyncio
async def test_template_engine_simple():
    dd = await template_engine.render(
        html_template="<p>Hola {{ nombre }}!</p>",
        data={"nombre": "Mundo"},
    )
    assert dd.html == "<p>Hola Mundo!</p>"
    assert dd.recursos == {}
    assert dd.config == {}


@pytest.mark.asyncio
async def test_template_engine_with_extra():
    dd = await template_engine.render(
        html_template="<p>{{ nombre }} - {{ curso }}</p>",
        data={"nombre": "Juan", "curso": "Seguridad"},
        recursos={"logo": "/uploads/logo.png"},
        config={"color_primario": "#333"},
    )
    assert dd.html == "<p>Juan - Seguridad</p>"
    assert dd.recursos["logo"] == "/uploads/logo.png"
    assert dd.config["color_primario"] == "#333"


@pytest.mark.asyncio
async def test_weasyprint_renderer_creates_pdf():
    doc = DocumentDefinition(
        html="<html><body><p>Test PDF</p></body></html>",
        recursos={},
        config={},
    )
    qr_custom = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50"/></svg>'
    pdf = await WeasyPrintRenderer().render(doc, qr_custom)
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 100


@pytest.mark.asyncio
async def test_weasyprint_renderer_qr_injection():
    doc = DocumentDefinition(
        html="<html><body><p>QR Test</p></body></html>",
        recursos={},
        config={},
    )
    qr_custom = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="30" height="30"/></svg>'
    pdf = await WeasyPrintRenderer().render(doc, qr_custom)
    assert pdf.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_renderer_inject_qr_placeholder():
    renderer = WeasyPrintRenderer()
    html = '<html><body>{{qr}}</body></html>'
    qr = '<svg></svg>'
    result = renderer._inject_qr(html, qr)
    assert qr in result
    assert "{{qr}}" not in result


@pytest.mark.asyncio
async def test_renderer_inject_qr_automatic():
    renderer = WeasyPrintRenderer()
    html = '<html><body><p>No placeholder</p></body></html>'
    qr = '<svg></svg>'
    result = renderer._inject_qr(html, qr)
    assert qr in result
    assert "position:fixed" in result or "bottom:20px" in result


@pytest.mark.asyncio
async def test_renderer_inject_qr_no_body():
    renderer = WeasyPrintRenderer()
    html = '<p>No body tag</p>'
    qr = '<svg></svg>'
    result = renderer._inject_qr(html, qr)
    assert qr in result


@pytest.mark.asyncio
async def test_local_storage_provider_provider_name():
    sp = LocalStorageProvider(base_dir="/tmp")
    assert sp._provider_name == "local"
