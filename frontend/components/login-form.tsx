"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      if (!formData.email || !formData.password) {
        setError("Ingresa correo y contraseña")
        setLoading(false)
        return
      }
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: formData.email, password: formData.password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error de autenticación" }))
        throw new Error(err.detail || (res.status === 401 ? "Credenciales inválidas" : `Error ${res.status}`))
      }
      const data = await res.json()
      const token = data.access_token as string
      localStorage.setItem("aaces_token", token)
      document.cookie = `aaces_token=${token}; path=/; max-age=604800; SameSite=Lax`
      let role: "admin" | "client" = "client"
      try {
        const parts = token.split(".")
        if (parts.length === 3) {
          const payload = JSON.parse(typeof atob === "function" ? atob(parts[1]) : Buffer.from(parts[1], "base64").toString("utf-8"))
          role = payload.role === "admin" ? "admin" : "client"
          localStorage.setItem("aaces_user", JSON.stringify({ id: payload.sub, email: payload.email, nombre: payload.name, rol: role }))
        }
      } catch {}
      const mustChange = Boolean(data.must_change_password)
      if (mustChange && role === "client") {
        router.push("/cliente/cambiar-password")
        return
      }
      router.push(role === "admin" ? "/admin/dashboard" : "/cliente/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión")
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Iniciar sesión</h1>
                <p className="text-balance text-muted-foreground">
                  Accede a tu cuenta de AACES
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" name="email" type="email" placeholder="correo@ejemplo.com" required value={formData.email} onChange={handleChange} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Contraseña</Label>
                </div>
                <Input id="password" name="password" type="password" required value={formData.password} onChange={handleChange} />
              </div>
              {error && (<div className="text-xs text-[var(--destructive)]">{error}</div>)}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Iniciando…" : "Entrar"}</Button>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  O continúa con
                </span>
              </div>
              <div className="text-center text-sm text-muted-foreground">Próximamente: inicio con Google y Apple</div>
              <div className="text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <a href="/contacto" className="underline underline-offset-4 hover:text-foreground">
                  Solicita acceso
                </a>
              </div>
            </div>
          </form>
          <div className="relative hidden bg-muted md:block">
            <Image
              src="/logo.png"
              alt="AACES"
              fill
              priority
              className="object-contain p-8 dark:brightness-[0.9]"
            />
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        Al continuar, aceptas nuestros <a href="#">Términos de Servicio</a>{" "}
        y <a href="#">Política de Privacidad</a>.
      </div>
    </div>
  )
}
