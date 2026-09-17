import React, { type FC } from 'react';
import {
  SidePanel,
  WixDesignSystemProvider,
  SectionHelper,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const Panel: FC = () => {
  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <SidePanel.Field>
            <SectionHelper fullWidth appearance="standard">
              This garden displays only the signed-in member’s saved Eve Moments.
            </SectionHelper>
          </SidePanel.Field>
        </SidePanel.Content>
        <SidePanel.Footer noPadding>
          <SectionHelper fullWidth appearance="success" border="topBottom">
            One completed prompt grows one flower. There are no points or streaks.
          </SectionHelper>
        </SidePanel.Footer>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
