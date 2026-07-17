from fastapi import APIRouter
from app.api.v1.endpoints import clientes, validaciones, auth, admin, contacto, dashboard, templates, documentos, constancias, verificaciones, reportes, cursos, participantes, dashboard_kpi, verificar

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(clientes.router, prefix="/clientes", tags=["clientes"])
api_router.include_router(validaciones.router, prefix="/validaciones", tags=["validaciones"])
api_router.include_router(dashboard.router, prefix="/clientes/dashboard", tags=["dashboard"])

# Add more routers as they are created
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(contacto.router, tags=["contacto"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(documentos.router, prefix="/documentos", tags=["documentos"])
api_router.include_router(constancias.router, prefix="/constancias", tags=["constancias"])
api_router.include_router(verificaciones.router, prefix="/verificaciones", tags=["verificaciones"])
# api_router.include_router(cursos.router, prefix="/cursos", tags=["cursos"])
# api_router.include_router(participantes.router, prefix="/participantes", tags=["participantes"])
api_router.include_router(dashboard_kpi.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(verificar.router, prefix="/verificar", tags=["verificar"])
# api_router.include_router(pagos.router, prefix="/pagos", tags=["pagos"])
api_router.include_router(reportes.router, prefix="/reportes", tags=["reportes"])
api_router.include_router(cursos.router, prefix="/cursos", tags=["cursos"])
api_router.include_router(participantes.router, prefix="/participantes", tags=["participantes"])
