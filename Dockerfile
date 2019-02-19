FROM nginx:alpine
COPY client /usr/share/nginx/html
#COPY nginx.conf /etc/nginx/nginx.conf