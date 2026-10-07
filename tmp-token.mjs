import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const user = await p.user.findFirst({ where: { role: 'ADMIN' } });
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const token = await new SignJWT({ sub: user.id, email: user.email, name: user.name, role: user.role })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret);
process.stdout.write(token);
await p.$disconnect();
