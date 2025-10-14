    },
    {
      "id": "U9-FRQ-EX01",
      "type": "free-response",
      "prompt": "A random sample of 60 AP Statistics students tracked whether they completed a new practice regimen before the unit test. For each student, the teacher recorded a binary indicator for completing the regimen (1 = completed, 0 = not completed) and the resulting test score. Describe how to construct and interpret a 95% confidence interval for the difference in mean test scores (completed minus not completed). Your response should justify conditions, show the interval calculation, and explain the result in the context of the study.",
      "frqConfig": {
        "exemplar": "State: We want a 95% confidence interval for the difference in mean test scores, \\u03bc_completed - \\u03bc_not.\n\nPlan: Students were randomly selected, so independence is reasonable. Each group contains at least 30 students, so by the Central Limit Theorem the sampling distribution of the difference in sample means is approximately normal.\n\nDo: Suppose the sample produced \\bar{x}_completed = 86.4 (s = 5.2, n = 31) and \\bar{x}_not = 82.1 (s = 6.0, n = 29). The standard error is \\sqrt{\\frac{5.2^2}{31} + \\frac{6.0^2}{29}} \approx 1.47. Using a t critical value with df \approx 56 (2.003), the 95% confidence interval is (86.4 - 82.1) \\pm 2.003(1.47) = 4.3 \\pm 2.9, or (1.4, 7.2).\n\nConclude: We are 95% confident that the mean test score for students who completed the regimen is between 1.4 and 7.2 points higher than for those who did not complete it. Because the interval is entirely above zero, the data provide evidence that the regimen improves scores.",
        "rubric": {
          "scoreGuide": [
            {
              "score": 5,
              "label": "Exemplary",
              "description": "States the parameter, verifies conditions, computes the interval correctly, and interprets the result in context."
            },
            {
              "score": 3,
              "label": "Developing",
              "description": "Shows partial reasoning but omits a key component (such as conditions or interpretation) or makes a minor arithmetic mistake."
            },
            {
              "score": 1,
              "label": "Beginning",
              "description": "Provides minimal work or major conceptual errors that prevent constructing or interpreting the interval."
            }
          ],
          "criteria": [
            {
              "name": "Statistical Understanding",
              "levels": [
                {
                  "score": 5,
                  "description": "Correctly identifies the difference in population means as the target parameter and justifies independence and normality conditions."
                },
                {
                  "score": 3,
                  "description": "Identifies the parameter but provides incomplete or partially correct condition checks."
                },
                {
                  "score": 1,
                  "description": "Misidentifies the parameter or omits all condition checks."
                }
              ]
            },
            {
              "name": "Computation",
              "levels": [
                {
                  "score": 5,
                  "description": "Uses the correct two-sample t-interval formula with accurate standard error and critical value."
                },
                {
                  "score": 3,
                  "description": "Applies the correct method but makes a minor arithmetic or rounding mistake."
                },
                {
                  "score": 1,
                  "description": "Uses an inappropriate procedure or makes major calculation errors."
                }
              ]
            },
            {
              "name": "Interpretation",
              "levels": [
                {
                  "score": 5,
                  "description": "Provides a contextual interpretation of the interval and addresses practical significance."
                },
                {
                  "score": 3,
                  "description": "Attempts an interpretation but omits context or mentions only statistical significance."
                },
                {
                  "score": 1,
                  "description": "No interpretation or an incorrect interpretation of the interval."
                }
              ]
            }
          ]
        }
      }