/** Core user shape shared by web app, extension auth, and API types. */
export interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}
