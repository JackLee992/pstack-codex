------------------------------ MODULE Owner ------------------------------
EXTENDS Integers
CONSTANT GuardGeneration
VARIABLES generation, pending, phase, cancelled
vars == <<generation, pending, phase, cancelled>>

Init == /\ generation = 0
        /\ pending = -1
        /\ phase = "running"
        /\ cancelled = FALSE

Queue == /\ phase = "running" /\ pending = -1
         /\ pending' = generation
         /\ UNCHANGED <<generation, phase, cancelled>>

Cancel == /\ phase = "running"
          /\ phase' = "cancelled"
          /\ cancelled' = TRUE
          /\ generation' = generation + 1
          /\ UNCHANGED pending

ReceiveAck == /\ pending # -1
              /\ IF GuardGeneration /\ pending # generation
                    THEN /\ pending' = -1
                         /\ UNCHANGED <<generation, phase, cancelled>>
                    ELSE /\ phase' = "complete"
                         /\ pending' = -1
                         /\ UNCHANGED <<generation, cancelled>>

Done == /\ phase \in {"complete", "cancelled"}
        /\ pending = -1
        /\ UNCHANGED vars

Next == Queue \/ Cancel \/ ReceiveAck \/ Done
CancelStaysTerminal == cancelled => phase # "complete"
=============================================================================
