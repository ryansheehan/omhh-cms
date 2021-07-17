import React, { memo, useState } from 'react';
import { InputText, Label } from '@buffetjs/core';
import styled from 'styled-components';

const Layout = styled.div`
  padding-left: 1em;
`;

const MyLabel = styled(Label)`
  margin-left: 3em;
  margin-top: ${({ theme }) => {
    console.log(theme);
    return `5px`
  }};
`;

const NewRecipe = () => {
  const [val, setValue] = useState('');

  return (
    <Layout>
      <h1>New Recipe</h1>
      <MyLabel htmlFor="name">Recipe name</MyLabel>
      <InputText
        name="name"
        onChange={({ target: { value } }) => setValue(value)}
        placeholder="Recipe name"
        type="text"
        value={val}
      />
    </Layout>
  );
}

export default memo(NewRecipe);