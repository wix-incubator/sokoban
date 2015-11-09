import 'source-map-support/register';
import chai from 'chai';

import SinonChai from 'sinon-chai';
chai.use(SinonChai);

import ChaiString from 'chai-string';
chai.use(ChaiString);

import ChaiAsPromised from 'chai-as-promised';
chai.use(ChaiAsPromised);
