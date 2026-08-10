'use client';

import { withContinueProvider } from '../with-continue-provider';

interface GmbItem {
  id: string;
  name: string;
  accountName: string;
  locationName: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface GmbSelection {
  id: string;
  accountName: string;
  locationName: string;
}

export const GmbContinue = withContinueProvider<GmbItem, GmbSelection>({
  endpoint: 'pages',
  swrKey: 'load-gmb-locations',
  titleKey: 'select_location',
  titleDefault: 'Select Business Location:',
  emptyStateMessages: [
    {
      key: 'gmb_no_locations_found',
      text: "We couldn't find any business locations connected to your account.",
    },
    {
      key: 'gmb_ensure_business_verified',
      text: 'Please ensure your business is verified on Google My Business.',
    },
    {
      key: 'gmb_try_again',
      text: 'Please close this dialog, delete the integration and try again.',
    },
  ],
  getItemId: (item) => item.id,
  getSelectionValue: (item) => ({
    id: item.id,
    accountName: item.accountName,
    locationName: item.locationName,
  }),
  transformSaveData: (selection) => selection,
  isSelected: (item, selection) => selection?.id === item.id,
  renderItem: (item) => (
    <>
      <div className="flex justify-center">
        {item.picture?.data?.url ? (
          <img
            className="w-[80px] h-[80px] object-cover rounded-[8px]"
            src={item.picture.data.url}
            alt={item.name}
          />
        ) : (
          <div className="w-[80px] h-[80px] bg-newBgColorInner rounded-[8px] flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
        )}
      </div>
      <div className="text-[14px] font-[500]">{item.name}</div>
    </>
  ),
});
