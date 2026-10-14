import React from 'react';
import { BusinessIdDisplay as UiBusinessIdDisplay, BusinessIdDisplayProps } from '@onebridge/ui-kit';

export interface WebAppBusinessIdProps extends Omit<BusinessIdDisplayProps, 'labels'> {
  labels?: BusinessIdDisplayProps['labels'];
}

export const BusinessIdDisplay: React.FC<WebAppBusinessIdProps> = (props) => {
  return <UiBusinessIdDisplay {...props} />;
};

export const AdminSettingsBusinessIdCard: React.FC<WebAppBusinessIdProps> = (props) => {
  return <UiBusinessIdDisplay variant="settings" {...props} />;
};

export const AdminRailFooter: React.FC<WebAppBusinessIdProps> = (props) => {
  return <UiBusinessIdDisplay variant="rail" {...props} />;
};

export const PublicProfileBusinessId: React.FC<WebAppBusinessIdProps> = (props) => {
  return <UiBusinessIdDisplay variant="public" {...props} />;
};
