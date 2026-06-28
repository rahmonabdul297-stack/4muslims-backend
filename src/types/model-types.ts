export interface UserTypes {
  name: string;
  username: string;
  email: string;
  password: string;
  bio?: string;
  DOB?: string;
  date?: Date;
}

export interface TokenPayloadTypes {
  id: string;
}
export interface resetPasswordTokenTypes {
  owner: string;
  token: string;
  createdAt: Date;
}
