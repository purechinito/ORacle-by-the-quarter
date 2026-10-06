ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER root
COPY configure-proxy.py /tmp/configure-proxy.py
RUN /home/frappe/frappe-bench/env/bin/python /tmp/configure-proxy.py
USER frappe
COPY --chown=frappe:frappe apps/quarter_erp /home/frappe/frappe-bench/apps/quarter_erp
RUN /home/frappe/frappe-bench/env/bin/pip install --no-deps -e /home/frappe/frappe-bench/apps/quarter_erp
RUN ln -s /home/frappe/frappe-bench/apps/quarter_erp/quarter_erp/public /home/frappe/frappe-bench/assets/quarter_erp
