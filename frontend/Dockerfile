FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG INTERNAL_API_URL=http://gateway:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static .next/static
COPY --from=builder /app/public public
EXPOSE 3000
CMD ["node", "server.js"]
