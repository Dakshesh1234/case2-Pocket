import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? window.location.origin 
  : '/api';

const api = axios.create({
  baseURL,
});

export default api;
