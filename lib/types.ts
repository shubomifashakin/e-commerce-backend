export interface User {
  email: string;
  first_name: string;
  last_name: string;
  id: string;
}

export interface UserWithPassword extends User {
  password: string;
}

declare global {
  namespace Express {
    interface Request {
      user_id?: string;
    }
  }
}

export interface Product {
  name: string;
  price: number;
  image: string;
  id: string;
  description: string;
}

export interface OrderItem {
  quantity: number;
}

export interface PastOrder extends OrderItem {
  product: Product;
}
