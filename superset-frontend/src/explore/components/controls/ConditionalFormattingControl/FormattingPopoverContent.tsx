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
import React, { ReactNode } from 'react';
import {
  JsonValue,
  styled,
  SupersetTheme,
  t,
  useTheme,
} from '@superset-ui/core';
import { Form, FormItem, FormProps } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import { Col, Row } from 'src/components';
import { InputNumber } from 'src/components/Input';
import Button from 'src/components/Button';
import CheckboxControl from '../CheckboxControl';
import {
  COMPARATOR,
  ConditionalFormattingConfig,
  MULTIPLE_VALUE_COMPARATORS,
} from './types';
import RadioButtonControl from '../../../../../packages/superset-ui-chart-controls/src/shared-controls/components/RadioButtonControl';

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const colorSchemeOptions = (theme: SupersetTheme) => [
  { value: theme.colors.success.light1, label: t('success') },
  { value: theme.colors.alert.light1, label: t('alert') },
  { value: theme.colors.error.light1, label: t('error') },
  { value: theme.colors.success.dark1, label: t('success dark') },
  { value: theme.colors.alert.dark1, label: t('alert dark') },
  { value: theme.colors.error.dark1, label: t('error dark') },
];

const operatorOptions = [
  { value: COMPARATOR.NONE, label: t('None') },
  { value: COMPARATOR.GREATER_THAN, label: '>' },
  { value: COMPARATOR.LESS_THAN, label: '<' },
  { value: COMPARATOR.GREATER_OR_EQUAL, label: '≥' },
  { value: COMPARATOR.LESS_OR_EQUAL, label: '≤' },
  { value: COMPARATOR.EQUAL, label: '=' },
  { value: COMPARATOR.NOT_EQUAL, label: '≠' },
  { value: COMPARATOR.BETWEEN, label: '< x <' },
  { value: COMPARATOR.BETWEEN_OR_EQUAL, label: '≤ x ≤' },
  { value: COMPARATOR.BETWEEN_OR_LEFT_EQUAL, label: '≤ x <' },
  { value: COMPARATOR.BETWEEN_OR_RIGHT_EQUAL, label: '< x ≤' },
];

const targetValueValidator =
  (
    compare: (targetValue: number, compareValue: number) => boolean,
    rejectMessage: string,
  ) =>
  (targetValue: number | string) =>
  (_: any, compareValue: number | string) => {
    if (
      !targetValue ||
      !compareValue ||
      compare(Number(targetValue), Number(compareValue))
    ) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(rejectMessage));
  };

const targetValueLeftValidator = targetValueValidator(
  (target: number, val: number) => target > val,
  t('This value should be smaller than the right target value'),
);

const targetValueRightValidator = targetValueValidator(
  (target: number, val: number) => target < val,
  t('This value should be greater than the left target value'),
);

const isOperatorMultiValue = (operator?: COMPARATOR) =>
  operator && MULTIPLE_VALUE_COMPARATORS.includes(operator);

const isOperatorNone = (operator?: COMPARATOR) =>
  !operator || operator === COMPARATOR.NONE;

const rulesRequired = [{ required: true, message: t('Required') }];

type GetFieldValue = Pick<Required<FormProps>['form'], 'getFieldValue'>;
const rulesTargetValueLeft = [
  { required: true, message: t('Required') },
  ({ getFieldValue }: GetFieldValue) => ({
    validator: targetValueLeftValidator(getFieldValue('targetValueRight')),
  }),
];

const rulesTargetValueRight = [
  { required: true, message: t('Required') },
  ({ getFieldValue }: GetFieldValue) => ({
    validator: targetValueRightValidator(getFieldValue('targetValueLeft')),
  }),
];

const targetValueLeftDeps = ['targetValueRight'];
const targetValueRightDeps = ['targetValueLeft'];

const shouldFormItemUpdate = (
  prevValues: ConditionalFormattingConfig,
  currentValues: ConditionalFormattingConfig,
) =>
  isOperatorNone(prevValues.operator) !==
    isOperatorNone(currentValues.operator) ||
  isOperatorMultiValue(prevValues.operator) !==
    isOperatorMultiValue(currentValues.operator);

const operatorField = (
  <FormItem
    name="operator"
    label={t('Operator')}
    rules={rulesRequired}
    initialValue={operatorOptions[0].value}
  >
    <Select ariaLabel={t('Operator')} options={operatorOptions} />
  </FormItem>
);

const renderOperatorFields = ({ getFieldValue }: GetFieldValue) =>
  isOperatorNone(getFieldValue('operator')) ? (
    <Row gutter={12}>
      <Col span={6}>{operatorField}</Col>
    </Row>
  ) : isOperatorMultiValue(getFieldValue('operator')) ? (
    <Row gutter={12}>
      <Col span={9}>
        <FormItem
          name="targetValueLeft"
          label={t('Left value')}
          rules={rulesTargetValueLeft}
          dependencies={targetValueLeftDeps}
          validateTrigger="onBlur"
          trigger="onBlur"
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
      <Col span={6}>{operatorField}</Col>
      <Col span={9}>
        <FormItem
          name="targetValueRight"
          label={t('Right value')}
          rules={rulesTargetValueRight}
          dependencies={targetValueRightDeps}
          validateTrigger="onBlur"
          trigger="onBlur"
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
    </Row>
  ) : (
    <Row gutter={12}>
      <Col span={6}>{operatorField}</Col>
      <Col span={18}>
        <FormItem
          name="targetValue"
          label={t('Target value')}
          rules={rulesRequired}
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
    </Row>
  );
export enum RadioValueSideIcon {
  right = 'right',
  left = 'left',
}
export const RadioValueSideIconOptions: [
  JsonValue,
  Exclude<ReactNode, null | undefined | boolean>,
][] = [
  [RadioValueSideIcon.left, t('left')],
  [RadioValueSideIcon.right, t('right')],
];

export enum RadioValueFormat {
  Color = 'color',
  Style = 'style',
}
export const RadioValueFormatOptions: [
  JsonValue,
  Exclude<ReactNode, null | undefined | boolean>,
][] = [
  [null, t('None')],
  [RadioValueFormat.Color, t('Color')],
  [RadioValueFormat.Style, t('Style')],
];
const styleSchemeOptions = (theme: SupersetTheme) => [
  {
    value: theme.styles.style1.name,
    label: t('rm-st-1'),
  },
  {
    value: theme.styles.style2.name,
    label: t('rm-st-2'),
  },
  {
    value: theme.styles.style3.name,
    label: t('rm-st-3'),
  },
  {
    value: theme.styles.style4.name,
    label: t('rm-st-4'),
  },
  {
    value: theme.styles.style5.name,
    label: t('rm-st-5'),
  },
  {
    value: theme.styles.style6.name,
    label: t('rm-st-6'),
  },
  {
    value: theme.styles.style7.name,
    label: t('rm-st-7'),
  },
  {
    value: theme.styles.style8.name,
    label: t('rm-st-8'),
  },
  {
    value: theme.styles.style9.name,
    label: t('rm-st-9'),
  },
  {
    value: theme.styles.style10.name,
    label: t('rm-st-10'),
  },
];

const styleIconOptions = (theme: SupersetTheme) => [
  {
    value: theme.icons.arrowTrendUp.name,
    label: theme.icons.arrowTrendUp.element,
  },
  {
    value: theme.icons.arrowTrendDown.name,
    label: theme.icons.arrowTrendDown.element,
  },
  {
    value: theme.icons.caretUp.name,
    label: theme.icons.caretUp.element,
  },
  {
    value: theme.icons.caretDown.name,
    label: theme.icons.caretDown.element,
  },
  {
    value: theme.icons.chevronUp.name,
    label: theme.icons.chevronUp.element,
  },
  {
    value: theme.icons.chevronDown.name,
    label: theme.icons.chevronDown.element,
  },
  {
    value: theme.icons.anglesUp.name,
    label: theme.icons.anglesUp.element,
  },
  {
    value: theme.icons.anglesDown.name,
    label: theme.icons.anglesDown.element,
  },
  {
    value: theme.icons.arrowUp.name,
    label: theme.icons.arrowUp.element,
  },
  {
    value: theme.icons.arrowDown.name,
    label: theme.icons.arrowDown.element,
  },
  {
    value: theme.icons.rubleSign.name,
    label: theme.icons.rubleSign.element,
  },
  {
    value: theme.icons.shield.name,
    label: theme.icons.shield.element,
  },
  {
    value: theme.icons.gear.name,
    label: theme.icons.gear.element,
  },
  {
    value: theme.icons.database.name,
    label: theme.icons.database.element,
  },
  {
    value: theme.icons.circleCheck.name,
    label: theme.icons.circleCheck.element,
  },
  {
    value: theme.icons.squareCheck.name,
    label: theme.icons.squareCheck.element,
  },
  {
    value: theme.icons.check.name,
    label: theme.icons.check.element,
  },
  {
    value: theme.icons.star.name,
    label: theme.icons.star.element,
  },
  {
    value: theme.icons.user.name,
    label: theme.icons.user.element,
  },
  {
    value: theme.icons.coins.name,
    label: theme.icons.coins.element,
  },
  {
    value: theme.icons.creditCard.name,
    label: theme.icons.creditCard.element,
  },
  {
    value: theme.icons.wallet.name,
    label: theme.icons.wallet.element,
  },
  {
    value: theme.icons.equals.name,
    label: theme.icons.equals.element,
  },
  {
    value: theme.icons.exclamation.name,
    label: theme.icons.exclamation.element,
  },
  {
    value: theme.icons.circleExclamation.name,
    label: theme.icons.circleExclamation.element,
  },
  {
    value: theme.icons.triangleExclamation.name,
    label: theme.icons.triangleExclamation.element,
  },
  {
    value: theme.icons.question.name,
    label: theme.icons.question.element,
  },
  {
    value: theme.icons.circleQuestion.name,
    label: theme.icons.circleQuestion.element,
  },
  {
    value: theme.icons.thumbsUp.name,
    label: theme.icons.thumbsUp.element,
  },
  {
    value: theme.icons.thumbsDown.name,
    label: theme.icons.thumbsDown.element,
  },
  {
    value: theme.icons.circle.name,
    label: theme.icons.circle.element,
  },
];

export const FormattingPopoverContent = ({
  config,
  onChange,
  columns = [],
  columnNan = [],
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string }[];
  columnNan: { label: string; value: string }[];
}) => {
  const theme = useTheme();
  const colorScheme = colorSchemeOptions(theme);
  const styleScheme = styleSchemeOptions(theme);
  const iconSchema = styleIconOptions(theme);
  const onIcon = false;
  const radioFormat = RadioValueFormatOptions[1][0];
  const radioSide = RadioValueSideIconOptions[0][0];
  const [onStyle, setChecked] = React.useState(false);
  const [onColor, setCheckedColor] = React.useState(true);
  const handleChange = () => {
    setChecked(!onStyle);
    setCheckedColor(!onColor);
    return !onColor;
  };
  return (
    <Form
      onFinish={onChange}
      initialValues={config}
      requiredMark="optional"
      layout="vertical"
    >
      <Row gutter={12}>
        <Col span={12}>
          <FormItem
            name="column"
            label={t('Column')}
            rules={rulesRequired}
            initialValue={columns[0]?.value}
          >
            <Select ariaLabel={t('Select column')} options={columns} />
          </FormItem>
          <FormItem
            name="onIcon"
            id="onIcon"
            label={t('ON ICON')}
            initialValue={onIcon}
          >
            <CheckboxControl checked={onIcon} />
          </FormItem>
          <FormItem
            name="radioSide"
            id="radioSide"
            label={t('SIDE ICON')}
            initialValue={radioSide}
          >
            <RadioButtonControl
              options={RadioValueSideIconOptions}
              onChange={handleChange}
            />
          </FormItem>
          <FormItem
            name="iconScheme"
            label={t('icon scheme')}
            rules={rulesRequired}
            initialValue={iconSchema[0].value}
          >
            <Select ariaLabel={t('icon scheme')} options={iconSchema} />
          </FormItem>
        </Col>
        <Col span={12}>
          <FormItem
            name="radioFormat"
            id="radioFormat"
            label={t('FORMAT')}
            initialValue={radioFormat}
          >
            <RadioButtonControl
              options={RadioValueFormatOptions}
              onChange={handleChange}
            />
          </FormItem>
          <FormItem
            name="colorScheme"
            label={t('Color scheme')}
            rules={rulesRequired}
            initialValue={colorScheme[0].value}
          >
            <Select ariaLabel={t('Color scheme')} options={colorScheme} />
          </FormItem>
          <FormItem
            name="styleScheme"
            label={t('style scheme')}
            rules={rulesRequired}
            initialValue={styleScheme[0].value}
          >
            <Select ariaLabel={t('Color scheme')} options={styleScheme} />
          </FormItem>
          <FormItem name="columnNan" label={t('Column')}>
            <Select
              mode="multiple"
              ariaLabel={t('Select column')}
              options={columnNan}
            />
          </FormItem>
        </Col>
      </Row>
      <FormItem noStyle shouldUpdate={shouldFormItemUpdate}>
        {renderOperatorFields}
      </FormItem>
      <FormItem>
        <JustifyEnd>
          <Button htmlType="submit" buttonStyle="primary">
            {t('Apply')}
          </Button>
        </JustifyEnd>
      </FormItem>
    </Form>
  );
};
