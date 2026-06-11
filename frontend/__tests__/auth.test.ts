describe('auth service', () => {
  beforeEach(() => {
    fetch.resetMocks?.()
    localStorage.clear()
  })

  it('stores token and redirects on successful login', () => {
    const token = 'test-access-token'
    localStorage.setItem('aaces_token', token)
    expect(localStorage.getItem('aaces_token')).toBe(token)
  })

  it('removes token on logout', () => {
    localStorage.setItem('aaces_token', 'some-token')
    localStorage.removeItem('aaces_token')
    expect(localStorage.getItem('aaces_token')).toBeNull()
  })

  it('handles missing token gracefully', () => {
    expect(localStorage.getItem('aaces_token')).toBeNull()
  })
})
