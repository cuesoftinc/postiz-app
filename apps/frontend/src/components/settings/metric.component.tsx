'use client';

import { Select } from '@gitroom/react/form/select';
import React, { useState } from 'react';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import timezones from 'timezones-list';
const dateMetrics = [
  { label: 'AM:PM', value: 'US' },
  { label: '24 hours', value: 'GLOBAL' },
];

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(timezone);

const MetricComponent = () => {
  const [currentMetric, setCurrentMetric] = useState(isUSCitizen());
  const [timezone, setTimezone] = useState(
    localStorage.getItem('timezone') || dayjs.tz.guess()
  );
  const changeMetric = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setCurrentMetric(value === 'US');
    localStorage.setItem('isUS', value);
  };

  const changeTimezone = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    console.log(value);
    setTimezone(value);
    localStorage.setItem('timezone', value);
    dayjs.tz.setDefault(value);
  };
  return (
    <div className="my-[16px] pt-[16px] border-t border-newTableBorder flex flex-col gap-[16px]">
      {/* Buffer section H2s measure 16/550 (round-1 addendum) */}
      <div className="text-[16px] font-[550]">Date Metrics</div>
      {/* Buffer never stretches a control across the pane — 200px select,
          matching the shortlink select geometry */}
      <div className="w-[200px] phone:w-full">
        <Select name="metric" disableForm={true} label="" onChange={changeMetric} value={currentMetric ? 'US' : 'GLOBAL'}>
          {dateMetrics.map((metric) => (
            <option
              key={metric.value}
              value={metric.value}
            >
              {metric.label}
            </option>
          ))}
        </Select>
      </div>

      {/*<div className="mt-[4px]">Current Timezone</div>*/}
      {/*<Select*/}
      {/*  name="timezone"*/}
      {/*  disableForm={true}*/}
      {/*  label=""*/}
      {/*  onChange={changeTimezone}*/}
      {/*>*/}
      {/*  {timezones.map((metric) => (*/}
      {/*    <option*/}
      {/*      key={metric.name}*/}
      {/*      value={metric.tzCode}*/}
      {/*      selected={metric.tzCode === timezone}*/}
      {/*    >*/}
      {/*      {metric.label}*/}
      {/*    </option>*/}
      {/*  ))}*/}
      {/*</Select>*/}
    </div>
  );
};

export default MetricComponent;
