import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface GetPlayerScoreData {
  leaderboardEntry?: {
    score: number;
  };
}

export interface GetPlayerScoreVariables {
  id: string;
}

export interface GetTopScoresData {
  leaderboardEntries: ({
    id: string;
    score: number;
  } & LeaderboardEntry_Key)[];
}

export interface LeaderboardEntry_Key {
  id: string;
  __typename?: 'LeaderboardEntry_Key';
}

export interface UpsertScoreData {
  leaderboardEntry_upsert: LeaderboardEntry_Key;
}

export interface UpsertScoreVariables {
  id: string;
  score: number;
}

interface UpsertScoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertScoreVariables): MutationRef<UpsertScoreData, UpsertScoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertScoreVariables): MutationRef<UpsertScoreData, UpsertScoreVariables>;
  operationName: string;
}
export const upsertScoreRef: UpsertScoreRef;

export function upsertScore(vars: UpsertScoreVariables): MutationPromise<UpsertScoreData, UpsertScoreVariables>;
export function upsertScore(dc: DataConnect, vars: UpsertScoreVariables): MutationPromise<UpsertScoreData, UpsertScoreVariables>;

interface GetTopScoresRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetTopScoresData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetTopScoresData, undefined>;
  operationName: string;
}
export const getTopScoresRef: GetTopScoresRef;

export function getTopScores(): QueryPromise<GetTopScoresData, undefined>;
export function getTopScores(dc: DataConnect): QueryPromise<GetTopScoresData, undefined>;

interface GetPlayerScoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPlayerScoreVariables): QueryRef<GetPlayerScoreData, GetPlayerScoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetPlayerScoreVariables): QueryRef<GetPlayerScoreData, GetPlayerScoreVariables>;
  operationName: string;
}
export const getPlayerScoreRef: GetPlayerScoreRef;

export function getPlayerScore(vars: GetPlayerScoreVariables): QueryPromise<GetPlayerScoreData, GetPlayerScoreVariables>;
export function getPlayerScore(dc: DataConnect, vars: GetPlayerScoreVariables): QueryPromise<GetPlayerScoreData, GetPlayerScoreVariables>;

