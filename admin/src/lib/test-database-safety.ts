export function assertSafeIntegrationDatabaseUrl(value:string|undefined){
  if(!value)throw new Error("TEST_DATABASE_URL is required for integration tests.")
  let url:URL;try{url=new URL(value)}catch{throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.")}
  if(!["postgres:","postgresql:"].includes(url.protocol))throw new Error("Integration tests require PostgreSQL.")
  const local=["127.0.0.1","localhost","::1","postgres-integration"].includes(url.hostname)
  if(!local)throw new Error("Integration tests may only use the dedicated local or CI service database host.")
  const database=url.pathname.slice(1).toLowerCase()
  if(!/(?:^|_)(?:test|integration)(?:_|$)/.test(database))throw new Error("Integration database name must contain a distinct test or integration segment.")
  if(/[?&]sslmode=require/.test(value)&&!local)throw new Error("Refusing a remote production-style integration database URL.")
  return value
}
