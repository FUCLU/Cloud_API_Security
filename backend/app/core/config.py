from pydantic_settings import BaseSettings
from pydantic import computed_field

class Settings(BaseSettings):
    # Datebase
    database_url: str

    # Keycloak (internal network)
    keycloak_url: str
    keycloak_realm: str

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
    
settings = Settings()
