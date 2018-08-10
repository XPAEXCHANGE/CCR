FROM node:8.11.3-stretch
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
RUN chmod 770 config
RUN apt-get update && \
    apt-get install sudo && \
    apt-get install pwgen
ENV u_pwd $(echo fubar | pwgen 8 1)
RUN useradd -ms /bin/bash nino
RUN echo "nino:${u_pwd}" | chpasswd 
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
RUN echo 'nino ALL=(ALL) ALL' >> /etc/sudoers
USER nino
CMD echo ${u_pwd} | sudo -S npm start

