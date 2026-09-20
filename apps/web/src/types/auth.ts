export type AuthUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: "OWNER" | "ADMIN" | "APPRAISER" | "VIEWER";
  isActive: boolean;
};

export type UserManagementUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: "OWNER" | "ADMIN" | "APPRAISER" | "VIEWER";
  isActive: boolean;
  createdAt: string;
};
