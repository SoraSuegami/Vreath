# Phoenix
#### Make Your Apps Immortal with Block Chain and Dag
-------------------------------------------------------


## Introduction
1. The Beginning of Decentralized World  

     These days, a lot of applications support our living. However, most of them ***depend on centralized servers and organizations managing them.*** This situation causes three problems.
    * Single point of failure
    * Large expenses to manage apps
    * Dictatorial of managing organizations  


     Block chain solves them. Dapp(application running in block chain) has the following features.
    * Decentralized
    * No cost to manage apps
    * No manager

1. Problems to Familiarize Block Chain  

     Block chain has a high potential, but it is ***not practical and user-friendly.*** The reasons are  
    * Not scalable  
    * Slow Confirmations  
    * Transaction Fee  

     Let's show you the case of Dapp SNS. Even if it has as many users as Facebook, it don't have enough throughput to deal with all users. Also, there are big time lags to reach your messages. Besides, when posting comments, it require fee of users. Like this, Block chain is not as yet realistic.

1. Dag --- Post Block Chain  

     As it will be able to solve the above problems, Dag is often regarded as post block chain. Its Users confirm another person's transactions to add theirs in Dag and have someone confirm them.(If they confirm invalid transactions, theirs won't be confirmed)

     It is very ***scalable.*** Even though its users increase, confirmers increase as well. Dag solve scalability issues at its foundation. It is also very ***fast.*** Transactions are confirmed asynchronously, so users don't have to wait like block chain. We need ***no fee*** to add new transactions. As mentioned above, other person confirm them for theirselves, in other words confirmer don't require any fee.  

     Dag looks perfect, but it has some disadvantage. One of them is ***less consistency.*** There is some possibility of permitting invalid remittance. For instance, even though Alice has only 5 coin, she may be able to send 5 coin to two other persons at almost the same time because her transactions are confirmed asynchronously. It is unstable to express value.  
 
## Solution --- Dag marries Block Chain
1. Use Block Chain and Dag Properly

     Our main idea is very simple, using block chain and dag properly. Block Chain is only used for remittance, issue token and saving data hash. (Raw data is saved by some nodes.) Dag is in charge of the others processing. It means that ***only what demands consistency uses block chain.*** (You may think it's similar to the relationship between RDB and NoSQL.)

1. More Secure Consensus Algorithm with Dag

     Dag makes block chain consensus algorithm more secure. We choose PoS because
   * Fast
   * Earth-friendly
   * Preventing 51% attack

     However, it has some problems such as ***Nothing at Stake.*** Validators (miners in PoS) have few loss when creating invalid blocks. This will confuse our system.

     *Proof of Stake with Dag* --- original new consensus algorithm solves Nothing at Stake. Validators have to sacrifice data in dag which users created to earn confirming reward, so they buy data from users before confirming. They can't use same dag data as sacrifices again.(Even when creating invalid blocks) For these reasons, *they have great loss enough to refrain from creating invalid blocks* and *Proof of Stake with Dag* solves Nothing at Stake.

## Advantage --- By using apps, User and Developer make profits


## Technical Points
1. How to link Block Chain and Dag together
    1. Hash Evidence
    1. Dynamic Outputs
    1. Domino Transactions

1. Proof of Stake with Dag

1. Triple Benefit Protocol

1. zk-starks

1. Deposit in App


## Problems --- Delay of Selling Dag Data


## Vision


## Conclusion


## References
