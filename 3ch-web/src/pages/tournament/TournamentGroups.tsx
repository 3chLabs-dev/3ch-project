import { useLocation, useParams } from "react-router-dom";
import LeagueProgramList from "../league/LeagueProgramList";
import { tournamentLeagueKey } from "../../features/tournament/leagueScope";

export default function TournamentGroups() {
  const { id = "", divisionId = "" } = useParams();
  const location = useLocation();
  return <LeagueProgramList resourceKey={tournamentLeagueKey(id, divisionId)} initialFormation={location.pathname.endsWith("/groups")} />;
}
