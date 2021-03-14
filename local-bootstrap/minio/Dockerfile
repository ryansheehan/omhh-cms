FROM amazon/aws-cli:2.1.29
VOLUME ["/root/.aws"]
ADD ./bootstrap.sh /aws/bootstrap.sh
RUN chmod +x /aws/bootstrap.sh
ENTRYPOINT [ "/aws/bootstrap.sh" ]
