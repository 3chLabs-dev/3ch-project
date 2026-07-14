import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "../../app/store";
import LeagueRenewalStep1BasicInfo from "./LeagueRenewalStep1BasicInfo";
import LeagueRenewalStep2Composition from "./LeagueRenewalStep2Composition";
import LeagueRenewalStep3Program from "./LeagueRenewalStep3Program";
import LeagueRenewalStep4RoundType from "./LeagueRenewalStep4RoundType";
import LeagueRenewalStep5RoundFormat from "./LeagueRenewalStep5RoundFormat";
import LeagueRenewalStep6RoundRules from "./LeagueRenewalStep6RoundRules";
import LeagueRenewalStep5Participants from "./LeagueRenewalStep5Participants";
import LeagueRenewalStep6Creating from "./LeagueRenewalStep6Creating";
import LeagueRenewalStep7Done from "./LeagueRenewalStep7Done";
export default function LeagueRenewalCreationWizard() { const step = useSelector((s: RootState) => s.leagueRenewalCreation.currentStep); switch (step) { case 0: return <Navigate to="/league" replace />; case 1: return <LeagueRenewalStep1BasicInfo />; case 2: return <LeagueRenewalStep2Composition />; case 3: return <LeagueRenewalStep3Program />; case 4: return <LeagueRenewalStep4RoundType />; case 5: return <LeagueRenewalStep5RoundFormat />; case 6: return <LeagueRenewalStep6RoundRules />; case 7: return <LeagueRenewalStep5Participants />; case 8: return <LeagueRenewalStep6Creating />; case 9: return <LeagueRenewalStep7Done />; default: return <Navigate to="/league" replace />; } }
