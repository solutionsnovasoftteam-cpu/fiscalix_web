import { getAuth } from "firebase-admin/auth";
import "./firebaseAdmin";


export async function verifyToken(token: string) {

    return await getAuth().verifyIdToken(token);

}