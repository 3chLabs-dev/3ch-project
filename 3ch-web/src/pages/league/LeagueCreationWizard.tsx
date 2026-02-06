import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import LeagueMain from './LeagueMain';
import LeagueStep1BasicInfo from './LeagueStep1BasicInfo';
import LeagueStep2TypeSelection from './LeagueStep2TypeSelection';
import LeagueStep3FormatSelection from './LeagueStep3FormatSelection';
import LeagueStep4Rules from './LeagueStep4Rules';
import LeagueStep5Participants from './LeagueStep5Participants';
import LeagueStep6Schedule from './LeagueStep6Schedule';
import LeagueStep7Summary from './LeagueStep7Summary'; // New import

const LeagueCreationWizard: React.FC = () => {
  const currentStep = useSelector((state: RootState) => state.leagueCreation.currentStep);

  switch (currentStep) {
    case 0:
      return <LeagueMain />;
    case 1:
      return <LeagueStep1BasicInfo />;
    case 2:
      return <LeagueStep2TypeSelection />;
    case 3:
      return <LeagueStep3FormatSelection />;
    case 4:
      return <LeagueStep4Rules />;
    case 5:
      return <LeagueStep5Participants />;
    case 6:
      return <LeagueStep6Schedule />;
    case 7:
      return <LeagueStep7Summary />;
    default:
      return <LeagueMain />; // Fallback
  }
};

export default LeagueCreationWizard;
