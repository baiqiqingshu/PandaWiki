import {
  VersionInfoMap,
  VersionInfo,
  getFeatureValue,
} from '@/constant/version';
import { ConstsLicenseEdition } from '@/request/types';

export const useFeatureValue = <K extends keyof VersionInfo['features']>(
  key: K,
): VersionInfo['features'][K] => {
  return getFeatureValue(ConstsLicenseEdition.LicenseEditionEnterprise, key);
};

export const useFeatureValueSupported = (
  _key: keyof VersionInfo['features'],
) => {
  return true;
};

export const useVersionInfo = () => {
  return VersionInfoMap[ConstsLicenseEdition.LicenseEditionEnterprise];
};
