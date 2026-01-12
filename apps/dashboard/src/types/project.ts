import { Service } from './service';

export interface Environment {
  id: string;
  name: string;
  projectId: string;
  services?: Service[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  userId: string;
  environments?: Environment[];
  createdAt: string;
  updatedAt: string;
}
