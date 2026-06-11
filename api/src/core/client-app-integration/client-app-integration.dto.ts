import { MaxLength } from "class-validator";

/**
 * DTO class for external "Forest Client API" response.
 * OpenAPI(Swagger) Details can be found in below links:
 * Environment TEST: https://nr-forest-client-api-test.api.gov.bc.ca/
 * Environment PROD: https://nr-forest-client-api-prod.api.gov.bc.ca/
*/
export class ClientAppIntegrationResponse {

  // Map to CLIENT app "clientNumber".
  @MaxLength(8)
  id!: string;

  // Map to CLIENT app "clientName".
  // Note, this could be single blan ' ' string on TEST environment, but PROD does not have empty name record.
  @MaxLength(500)
  name!: string;

  /*
    ACT (Active)
    DAC (Deactivated)
    DEC (Deceased)
    REC (Receivership)
    SPN (Suspended)
  */
  @MaxLength(5)
  clientStatusCode!: string;

  /*
    A (Association)
    B (First Nation Band)
    C (Corporation)
    F (Ministry of Forests and Range)
    G (Government)
    I (Individual)
    L (Limited Partnership)
    P (General Partnership)
    R (First Nation Group)
    S (Society)
    T (First Nation Tribal Council)
    U (Unregistered Company)
  */
  @MaxLength(3)
  clientTypeCode!: string;
}