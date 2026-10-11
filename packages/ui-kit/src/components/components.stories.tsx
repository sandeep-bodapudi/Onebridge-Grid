import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ActionButton } from './ActionButton';
import {
  StatusChip,
  ArchCard,
  KeystoneBadge,
  QrFrame,
  StatTile,
  SideDrawer,
  Toast,
  EmptyState,
  OfflineBanner,
  UpdateBanner
} from './index';

const meta = {
  title: 'UI Kit/Components',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;

export const ActionButtonPrimary: StoryObj = {
  render: () => <ActionButton variant="primary">Primary Action</ActionButton>
};
export const ActionButtonSecondary: StoryObj = {
  render: () => <ActionButton variant="secondary">Secondary Action</ActionButton>
};
export const ActionButtonGhost: StoryObj = {
  render: () => <ActionButton variant="ghost">Ghost Action</ActionButton>
};
export const ActionButtonLoading: StoryObj = {
  render: () => <ActionButton isLoading>Loading</ActionButton>
};
export const ActionButtonDisabled: StoryObj = {
  render: () => <ActionButton disabled>Disabled</ActionButton>
};

export const ArchCardDefault: StoryObj = {
  render: () => <ArchCard>Hello Arch Card</ArchCard>
};
export const ArchCardLoading: StoryObj = {
  render: () => <ArchCard isLoading />
};
export const ArchCardError: StoryObj = {
  render: () => <ArchCard error="Could not load content" />
};
export const ArchCardEmpty: StoryObj = {
  render: () => <ArchCard isEmpty />
};

export const KeystoneBadgeDefault: StoryObj = {
  render: () => <KeystoneBadge>Admin</KeystoneBadge>
};

export const QrFrameDefault: StoryObj = {
  render: () => <QrFrame><div style={{width: 100, height: 100, background: '#ccc'}} /></QrFrame>
};
export const QrFrameLoading: StoryObj = {
  render: () => <QrFrame isLoading />
};
export const QrFrameError: StoryObj = {
  render: () => <QrFrame error="Failed to generate QR" />
};
export const QrFrameEmpty: StoryObj = {
  render: () => <QrFrame isEmpty />
};

export const StatusChipSuccess: StoryObj = {
  render: () => <StatusChip status="success">Active</StatusChip>
};
export const StatusChipError: StoryObj = {
  render: () => <StatusChip status="error">Failed</StatusChip>
};

export const StatTileDefault: StoryObj = {
  render: () => <StatTile label="Total Scans" value="1,245" />
};
export const StatTileLoading: StoryObj = {
  render: () => <StatTile label="Total Scans" value="1,245" isLoading />
};
export const StatTileError: StoryObj = {
  render: () => <StatTile label="Total Scans" value="1,245" error="Fetch failed" />
};
export const StatTileEmpty: StoryObj = {
  render: () => <StatTile label="Total Scans" value="1,245" isEmpty />
};

export const SideDrawerOpen: StoryObj = {
  render: () => (
    <div style={{ width: '400px', height: '300px', position: 'relative', overflow: 'hidden', border: '1px solid #ccc' }}>
      <SideDrawer isOpen={true}>
        <div className="p-16">Drawer Content</div>
      </SideDrawer>
    </div>
  )
};

export const ToastInfo: StoryObj = {
  render: () => <Toast type="info" message="Profile updated successfully." />
};
export const ToastError: StoryObj = {
  render: () => <Toast type="error" message="Network error occurred." />
};

export const EmptyStateDefault: StoryObj = {
  render: () => <EmptyState message="No contacts found." />
};

export const OfflineBannerDefault: StoryObj = {
  render: () => <OfflineBanner message="You are offline" />
};

export const UpdateBannerDefault: StoryObj = {
  render: () => <UpdateBanner message="An update is available." />
};
