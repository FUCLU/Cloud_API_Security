from pydantic_settings import BaseSettings
from pydantic import computed_field

class Settings(BaseSettings):
    # Datebase
    database_url: str

    # Keycloak (internal network)
    keycloak_url: str
    keycloak_realm: str
    keycloak_client_id: str = "spa-client"
    keycloak_client_secret: str = ""
    keycloak_public_url: str = ""
    frontend_url: str = "https://app.fmsec.shop"
    auth_cookie_secure: bool = True

    # JWT verify
    jwt_issuer: str
    jwt_audience: str

    class Config:
        env_file = ".env"
        case_sensitive = False  # đọc được cả KEYCLOAK_URL lẫn keycloak_url
    
    @computed_field                        
    @property   
    def jwks_url(self) -> str:
        return f"{self.keycloak_url}/realms/{self.keycloak_realm}/protocol/openid-connect/certs"

    @computed_field
    @property
    def oidc_token_url(self) -> str:
        return f"{self.keycloak_url}/realms/{self.keycloak_realm}/protocol/openid-connect/token"

    @computed_field
    @property
    def oidc_logout_url(self) -> str:
        public_base = self.keycloak_public_url or self.keycloak_url
        return f"{public_base}/realms/{self.keycloak_realm}/protocol/openid-connect/logout"
    
settings = Settings()
