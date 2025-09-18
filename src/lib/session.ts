
import { getIronSession, IronSessionData } from "iron-session";
import { cookies } from "next/headers";
import { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
    password: process.env.SECRET_COOKIE_PASSWORD as string,
    cookieName: "bluebells-erp-session",
    cookieOptions: {
        secure: process.env.NODE_ENV === "production",
    },
};

export interface SessionData {
    isLoggedIn: boolean;
    username: string;
    role: 'admin' | 'accountant' | 'exam';
}

export async function getSession() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  return session;
}
