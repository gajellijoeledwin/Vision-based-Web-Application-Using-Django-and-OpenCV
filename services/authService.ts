import { User } from '../types';

// Mock User Data
const MOCK_USER: User = {
  id: 'u-123-456',
  username: 'thesis_scholar',
  email: 'scholar@university.edu',
  bio: 'Final Year Computer Science Student specializing in Computer Vision.',
  total_processed: 142,
  total_detections: 3890,
  date_joined: '2024-01-15T10:30:00Z',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-signature'
};

export const login = async (username: string, password: string): Promise<User> => {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 800));

  if (username && password) {
    return MOCK_USER;
  }
  throw new Error('Invalid credentials');
};

export const register = async (data: any): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { ...MOCK_USER, username: data.username, email: data.email };
};

export const logout = async (): Promise<void> => {
    localStorage.removeItem('vision_user');
};

export const getCurrentUser = (): User | null => {
    const stored = localStorage.getItem('vision_user');
    return stored ? JSON.parse(stored) : null;
};