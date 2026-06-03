import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse, PaginatedResponse, EventDto, RegistrationDto } from '@uniplan/shared';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        processQueue(null, data.accessToken);
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
}

export async function register(studentCode: string, email: string, password: string): Promise<void> {
  await api.post('/auth/register', { studentCode, email, password });
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function getEvents(params?: Record<string, string | number>): Promise<PaginatedResponse<EventDto>> {
  const { data } = await api.get('/events', { params });
  return data;
}

export async function getEvent(id: string): Promise<EventDto> {
  const { data } = await api.get(`/events/${id}`);
  return data;
}

export async function createEvent(eventData: Record<string, unknown>) {
  const { data } = await api.post('/events', eventData);
  return data;
}

export async function registerForEvent(eventId: string) {
  const { data } = await api.post('/registrations', { eventId });
  return data;
}

export async function cancelRegistration(id: string) {
  const { data } = await api.delete(`/registrations/${id}`);
  return data;
}

export async function getMyRegistrations(): Promise<RegistrationDto[]> {
  const { data } = await api.get('/registrations/mine');
  return data.data || data;
}

export async function applyAsOrganizer(formData: Record<string, unknown>) {
  const { data } = await api.post('/organizers/apply', formData);
  return data;
}

export async function updateEvent(id: string, eventData: Record<string, unknown>) {
  const { data } = await api.put(`/events/${id}`, eventData);
  return data;
}

export async function duplicateEvent(id: string, newDate?: string) {
  const { data } = await api.post(`/events/${id}/duplicate`, { newDate });
  return data;
}

export async function deleteEvent(id: string) {
  const { data } = await api.delete(`/events/${id}`);
  return data;
}

export async function getEventRegistrations(eventId: string) {
  const { data } = await api.get(`/registrations/event/${eventId}`);
  return data.data || data;
}

export async function exportEventCSV(eventId: string): Promise<string> {
  const { data } = await api.get(`/registrations/event/${eventId}/csv`, { responseType: 'text' });
  return data;
}

export async function getMessageHistory(eventId: string) {
  const { data } = await api.get(`/events/${eventId}/messages`);
  return data.data || data;
}

export async function sendMessage(eventId: string, text: string) {
  const { data } = await api.post(`/events/${eventId}/messages`, { text });
  return data;
}

export async function getOrganizers(filter?: string) {
  const { data } = await api.get('/admin/organizers', { params: { filter } });
  return data.data || data;
}

export async function approveOrganizer(id: string) {
  const { data } = await api.post(`/admin/organizers/${id}/approve`);
  return data;
}

export async function rejectOrganizer(id: string) {
  const { data } = await api.post(`/admin/organizers/${id}/reject`);
  return data;
}

export async function getAllStatistics() {
  const { data } = await api.get('/statistics/events');
  return data.data || data;
}

export async function getEventStatistics(id: string) {
  const { data } = await api.get(`/statistics/events/${id}`);
  return data;
}

export async function getOccupancyReport() {
  const { data } = await api.get('/reports/occupancy');
  return data.data || data;
}

export async function getParticipationReport() {
  const { data } = await api.get('/reports/participation');
  return data.data || data;
}

export async function getEngagementReport() {
  const { data } = await api.get('/reports/engagement');
  return data.data || data;
}

export default api;
