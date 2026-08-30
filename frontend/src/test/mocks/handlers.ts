import { http, HttpResponse } from 'msw'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://vskelf6n9b.execute-api.eu-west-3.amazonaws.com/dev'

export const handlers = [
  // Auth: Sign In
  http.post(`${API_BASE_URL}/auth/sign-in`, async ({ request }) => {
    const body = (await request.json()) as any
    if (body.email === 'registered@example.com' && body.password === 'ValidPass123!') {
      return HttpResponse.json({
        token: 'mocked-jwt-token-12345',
        accessToken: 'mocked-access-token-12345',
        user: {
          email: 'registered@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'CUSTOMER',
        },
      })
    }
    return new HttpResponse(
      JSON.stringify({ message: 'Invalid email or password' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }),

  // Auth: Sign Up
  http.post(`${API_BASE_URL}/auth/sign-up`, async ({ request }) => {
    const body = (await request.json()) as any
    if (body.email === 'duplicate@example.com') {
      return new HttpResponse(
        JSON.stringify({ message: 'User already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return HttpResponse.json({
      userId: 'user-id-999',
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      createdAt: new Date().toISOString(),
    })
  }),

  // Tours: Available Tours
  http.get(`${API_BASE_URL}/tours/available`, ({ request }) => {
    const url = new URL(request.url)
    const destination = url.searchParams.get('destination')

    if (destination === 'NonExistentPlace') {
      return HttpResponse.json({
        tours: [],
        total: 0,
        page: 1,
        pageSize: 10,
      })
    }

    return HttpResponse.json({
      tours: [
        {
          id: 'tour-1',
          title: 'Maldives Paradise Resort',
          destination: 'Maldives',
          price: 1200,
          rating: 4.8,
          reviewCount: 42,
          imageUrl: 'https://example.com/maldives.jpg',
          mealPlans: ['BB', 'HB', 'AI'],
          tourTypes: ['Resorts'],
          durations: [7, 10],
          startDate: '2026-08-01',
          endDate: '2026-08-08',
          maxParticipants: 10,
          availableSeats: 5,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    })
  }),
]
