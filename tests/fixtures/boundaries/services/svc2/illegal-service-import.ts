// Illegal boundary import: service importing another service source
import { ServiceOne } from '../svc1/index';
export const x = ServiceOne;
