"""gh-proxy: PAT-holding companion service for robojwc.

robojwc container holds zero credentials; every GitHub side-effect (REST +
git clone/fetch/push) flows through this service over an HMAC-authenticated
internal channel. See `robojwc.proxy.server` for the request surface.
"""
