import { SetMetadata } from '@nestjs/common';

export const API_KEY_ACCESS_KEY = 'apiKeyAccess';
export const ApiKeyAccess = () => SetMetadata(API_KEY_ACCESS_KEY, true);
