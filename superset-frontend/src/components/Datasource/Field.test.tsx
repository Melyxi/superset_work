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

import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { shallow } from 'enzyme';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import Field from './Field';

describe('Field', () => {
  const defaultProps = {
    fieldKey: 'mock',
    value: '',
    values: {},
    label: 'mock',
    description: 'description',
    control: <TextAreaControl />,
    onChange: jest.fn(),
    compact: false,
    inline: false,
  };

  it('should render', () => {
    const { container } = render(<Field {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('should call onChange', () => {
    const wrapper = shallow(<Field {...defaultProps} />);
    const textArea = wrapper.find(TextAreaControl);
    textArea.simulate('change', { target: { value: 'x' } });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('should render compact', () => {
    render(<Field {...defaultProps} compact />);
    expect(
      screen.queryByText(defaultProps.description),
    ).not.toBeInTheDocument();
  });
});
