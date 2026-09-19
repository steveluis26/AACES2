import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from '@/components/login-form'

describe('LoginForm', () => {
  beforeEach(() => {
    fetch.resetMocks?.()
    localStorage.clear()
  })

  it('renders the login form with email and password fields', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument()
  })

  it('shows error when submitting with empty fields', async () => {
    render(<LoginForm />)
    const submitButton = screen.getByRole('button', { name: /ingresar/i })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText(/ingresa correo y contraseña/i)).toBeInTheDocument()
    })
  })

  it('calls login API on valid submission', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token-123', refresh_token: 'test-refresh' }),
      })
    ) as jest.Mock

    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'TestPass1' } })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test@test.com'),
        })
      )
    })
  })

  it('displays error message on failed login', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'Credenciales inválidas' }),
      })
    ) as jest.Mock

    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'wrong@test.com' } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'WrongPass1' } })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() => {
      expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument()
    })
  })

  it('shows a readable message on 422 validation errors (never "[object Object]")', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            detail: [
              {
                loc: ['body', 'correo'],
                msg: 'value is not a valid email address',
                type: 'value_error.email',
              },
            ],
          }),
      })
    ) as jest.Mock

    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'demo-walkthrough@aaces.local' } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'TestPass1' } })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() => {
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
      expect(screen.getByText(/value is not a valid email address/i)).toBeInTheDocument()
    })
  })

  it('updates input values on change', () => {
    render(<LoginForm />)
    const emailInput = screen.getByLabelText(/correo/i)
    const passwordInput = screen.getByLabelText(/contraseña/i)

    fireEvent.change(emailInput, { target: { value: 'user@test.com' } })
    fireEvent.change(passwordInput, { target: { value: 'mypassword' } })

    expect(emailInput).toHaveValue('user@test.com')
    expect(passwordInput).toHaveValue('mypassword')
  })
})
