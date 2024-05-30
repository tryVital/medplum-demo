import axios from 'axios';

export const http = axios.create({
  baseURL: 'https://api.dev.tryvital.io',
  headers: {
    'Content-type': 'application/json',
    'x-vital-api-key': '<your-api-key-here>',
  },
});

export type PaginatedResponse = {
  total: number;
  page: number;
  size: number;
  pages: number;
};
