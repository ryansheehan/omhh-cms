FROM node:14.15.1-alpine3.10
WORKDIR /app
ENV NODE_ENV=production
ENV BROWSER=false
ENV STRAPI_TELEMETRY_DISABLED=true
COPY . .
VOLUME .tmp
RUN npm install && npm run build
CMD npm start --
