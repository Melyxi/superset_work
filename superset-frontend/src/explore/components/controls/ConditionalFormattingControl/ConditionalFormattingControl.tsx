/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useEffect, useState } from 'react';
import { styled, css, t, useTheme, supersetTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import ControlHeader from 'src/explore/components/ControlHeader';
import { FormattingPopover } from './FormattingPopover';
import {
  COMPARATOR,
  ConditionalFormattingConfig,
  ConditionalFormattingControlProps,
} from './types';
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from '../OptionControls';

const FormattersContainer = styled.div`
  ${({ theme }) => css`
    padding: ${theme.gridUnit}px;
    border: solid 1px ${theme.colors.grayscale.light2};
    border-radius: ${theme.gridUnit}px;
  `}
`;

export const FormatterContainer = styled(OptionControlContainer)`
  &,
  & > div {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
    :last-child {
      margin-bottom: 0;
    }
  }
`;

export const CloseButton = styled.button`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.light1};
    height: 100%;
    width: ${theme.gridUnit * 6}px;
    border: none;
    border-right: solid 1px ${theme.colors.grayscale.dark2}0C;
    padding: 0;
    outline: none;
    border-bottom-left-radius: 3px;
    border-top-left-radius: 3px;
  `}
`;

const ConditionalFormattingControl = ({
  value,
  onChange,
  columnNan,
  columnOptions,
  verboseMap,
  removeIrrelevantConditions,
  ...props
}: ConditionalFormattingControlProps) => {
  const theme = useTheme();
  const [conditionalFormattingConfigs, setConditionalFormattingConfigs] =
    useState<ConditionalFormattingConfig[]>(value ?? []);

  useEffect(() => {
    if (onChange) {
      onChange(conditionalFormattingConfigs);
    }
  }, [conditionalFormattingConfigs, onChange]);

  useEffect(() => {
    if (removeIrrelevantConditions) {
      // remove formatter when corresponding column is removed from controls
      const newFormattingConfigs = conditionalFormattingConfigs.filter(config =>
        columnOptions.some((option: any) => option?.value === config?.column),
      );
      if (
        newFormattingConfigs.length !== conditionalFormattingConfigs.length &&
        removeIrrelevantConditions
      ) {
        setConditionalFormattingConfigs(newFormattingConfigs);
      }
    }
  }, [conditionalFormattingConfigs, columnOptions, removeIrrelevantConditions]);

  const onDelete = (index: number) => {
    setConditionalFormattingConfigs(prevConfigs =>
      prevConfigs.filter((_, i) => i !== index),
    );
  };

  const onSave = (config: ConditionalFormattingConfig) => {
    setConditionalFormattingConfigs(prevConfigs => [...prevConfigs, config]);
  };

  const onEdit = (newConfig: ConditionalFormattingConfig, index: number) => {
    const newConfigs = [...conditionalFormattingConfigs];
    newConfigs.splice(index, 1, newConfig);
    setConditionalFormattingConfigs(newConfigs);
  };

  const createLabel = ({
    column,
    operator,
    targetValue,
    targetValueLeft,
    targetValueRight,
    styleScheme,
    radioFormat,
    columnNan,
  }: ConditionalFormattingConfig) => {
    const columnName = (column && verboseMap?.[column]) ?? column;
    let style;
    let nanColumn;
    if (columnNan) {
      if (columnNan.length > 0) {
        nanColumn = `${t('column')}: ${columnNan.join(', ')}`;
      } else {
        nanColumn = '';
      }
    } else {
      nanColumn = '';
    }

    if (radioFormat === 'style') {
      style = `${t('style')}: ${styleScheme}`;
      if (styleScheme) {
        style = `${t('style')}: ${supersetTheme.styles[styleScheme].className}`;
      } else {
        style = '';
      }
    } else {
      style = '';
    }
    // eslint-disable-next-line prefer-const
    const resString = `${style} ${nanColumn}`;
    switch (operator) {
      case COMPARATOR.NONE:
        return `${columnName} ${resString}`;
      case COMPARATOR.BETWEEN:
        return `${targetValueLeft} ${COMPARATOR.LESS_THAN} ${columnName} ${COMPARATOR.LESS_THAN} ${targetValueRight} ${resString}`;
      case COMPARATOR.BETWEEN_OR_EQUAL:
        return `${targetValueLeft} ${COMPARATOR.LESS_OR_EQUAL} ${columnName} ${COMPARATOR.LESS_OR_EQUAL} ${targetValueRight} ${resString}`;
      case COMPARATOR.BETWEEN_OR_LEFT_EQUAL:
        return `${targetValueLeft} ${COMPARATOR.LESS_OR_EQUAL} ${columnName} ${COMPARATOR.LESS_THAN} ${targetValueRight} ${resString}`;
      case COMPARATOR.BETWEEN_OR_RIGHT_EQUAL:
        return `${targetValueLeft} ${COMPARATOR.LESS_THAN} ${columnName} ${COMPARATOR.LESS_OR_EQUAL} ${targetValueRight} ${resString}`;
      default:
        return `${columnName} ${operator} ${targetValue} ${resString}`;
    }
  };
  const getColor = ({
    radioFormat,
    colorScheme,
  }: ConditionalFormattingConfig) => {
    if (radioFormat === 'color') {
      return colorScheme;
    }
    return theme.colors.grayscale.light3;
  };
  const OptionColor = styled.div<{
    color?: string;
  }>`
    background-color: ${({ color }) => color};
  `;
  return (
    <div>
      <ControlHeader {...props} />
      <FormattersContainer>
        {conditionalFormattingConfigs.map((config, index) => (
          <FormatterContainer key={index}>
            <CloseButton onClick={() => onDelete(index)}>
              <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
            </CloseButton>
            <FormattingPopover
              title={t('Edit formatter')}
              config={config}
              columns={columnOptions}
              columnNan={columnNan}
              onChange={(newConfig: ConditionalFormattingConfig) =>
                onEdit(newConfig, index)
              }
              destroyTooltipOnHide
            >
              <OptionControlContainer withCaret>
                <Label>{createLabel(config)}</Label>
                <CaretContainer>
                  <OptionColor color={getColor(config)}>
                    <Icons.CaretRight
                      iconColor={theme.colors.grayscale.light1}
                    />
                  </OptionColor>
                </CaretContainer>
              </OptionControlContainer>
            </FormattingPopover>
          </FormatterContainer>
        ))}
        <FormattingPopover
          title={t('Add new formatter')}
          columns={columnOptions}
          onChange={onSave}
          destroyTooltipOnHide
          columnNan={columnNan}
        >
          <AddControlLabel>
            <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
            {t('Add new color formatter')}
          </AddControlLabel>
        </FormattingPopover>
      </FormattersContainer>
    </div>
  );
};

export default ConditionalFormattingControl;
